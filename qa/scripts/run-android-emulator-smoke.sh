#!/usr/bin/env bash
# Deterministic Android shell and native video-picker smoke test.
# Run through android-emulator-runner from NexusNovaAndroid.
set +e

# Keep device commands bounded. A flaky emulator/ADB connection must not stall CI.
adb() {
  timeout --signal=TERM --kill-after=2s 15s adb "$@"
}

ROOT="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/../.." && pwd)"
RESULTS="$ROOT/qa/android-emulator-results"
mkdir -p "$RESULTS" || exit 1
cd "$ROOT/NexusNovaAndroid" || exit 1
PKG="com.nexusnova.app.novacutqa"
FIXTURE="$ROOT/qa/fixtures/video-studio-video-qa.webm"
LOGCAT_PID=""

stop_logcat() {
  if [ -n "$LOGCAT_PID" ]; then
    kill "$LOGCAT_PID" >/dev/null 2>&1 || true
    wait "$LOGCAT_PID" >/dev/null 2>&1 || true
    LOGCAT_PID=""
  fi
}

# Bypass the bounded shell function for each command so diagnostics have a
# tighter independent deadline and cannot consume the workflow's whole timeout.
capture_failure_diagnostics() {
  stop_logcat
  timeout --signal=TERM --kill-after=1s 5s adb devices > "$RESULTS/adb-devices.txt" 2>&1 || true
  timeout --signal=TERM --kill-after=1s 5s adb logcat -d -v threadtime > "$RESULTS/logcat-after-failure.txt" 2>&1 || true
  timeout --signal=TERM --kill-after=1s 5s adb shell dumpsys activity activities > "$RESULTS/activity-after-failure.txt" 2>&1 || true
  timeout --signal=TERM --kill-after=1s 5s adb shell dumpsys window > "$RESULTS/window-after-failure.txt" 2>&1 || true
}

fail() {
  echo "ANDROID SHELL/PICKER SMOKE FAIL: $*" | tee "$RESULTS/failure.txt" >&2
  capture_failure_diagnostics
  exit 1
}

wait_for_device() {
  local attempt
  for attempt in 1 2 3; do
    timeout --signal=TERM --kill-after=1s 4s adb reconnect offline >/dev/null 2>&1 || true
    timeout --signal=TERM --kill-after=1s 6s adb wait-for-device >/dev/null 2>&1 || true
    if timeout --signal=TERM --kill-after=1s 4s adb devices 2>/dev/null | grep -Eq '^emulator-[0-9]+[[:space:]]+device$'; then
      return 0
    fi
    echo "ADB not online on recovery attempt $attempt" >> "$RESULTS/adb-recovery.txt"
    sleep 1
  done
  return 1
}

pull_remote_file() {
  local remote="$1" output="$2" attempt status
  for attempt in 1 2 3; do
    if ! wait_for_device; then
      echo "Device offline before pull attempt $attempt for $remote" >> "$RESULTS/adb-recovery.txt"
      sleep 1
      continue
    fi
    adb pull "$remote" "$output" > "$output.adb.txt" 2>&1
    status=$?
    if [ "$status" -eq 0 ] && [ -s "$output" ]; then
      return 0
    fi
    echo "Pull attempt $attempt failed for $remote (status=$status)" >> "$RESULTS/adb-recovery.txt"
    sleep 1
  done
  return 1
}

capture_screenshot() {
  local output="$1"
  local attempt status
  for attempt in 1 2 3; do
    if ! wait_for_device; then
      echo "Device offline before screenshot attempt $attempt" >> "$RESULTS/screenshot-retries.txt"
      sleep 1
      continue
    fi

    # Stream the PNG directly over ADB. Writing a remote file then pulling it
    # doubled the ADB traffic and repeatedly destabilized the high-res AVD.
    : > "$output"
    adb exec-out screencap -p > "$output" 2> "$output.shell.txt"
    status=$?
    if [ "$status" -ne 0 ]; then
      echo "Direct screencap attempt $attempt failed (status=$status)" >> "$RESULTS/screenshot-retries.txt"
      sleep 1
      continue
    fi

    if python3 - "$output" <<'PY'
import sys
from pathlib import Path

data = Path(sys.argv[1]).read_bytes()
valid = (
    len(data) > 1024
    and data.startswith(bytes.fromhex("89504e470d0a1a0a"))
    and b"IHDR" in data[:32]
    and data.endswith(bytes.fromhex("0000000049454e44ae426082"))
)
raise SystemExit(0 if valid else 1)
PY
    then
      echo "Direct screenshot capture attempt $attempt PASS" >> "$RESULTS/screenshot-retries.txt"
      return 0
    fi

    echo "Direct screenshot PNG validation failed on attempt $attempt" >> "$RESULTS/screenshot-retries.txt"
    sleep 1
  done
  return 1
}

# Find the center of a visible UIAutomator node by its text/content description.
# Prints "x y" for adb input tap, or returns non-zero with a useful diagnostic.
find_node_center() {
  local xml_path="$1"
  local label="$2"
  python3 - "$xml_path" "$label" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

xml_path, wanted = sys.argv[1], " ".join(sys.argv[2].split()).casefold()
try:
    root = ET.parse(xml_path).getroot()
except (OSError, ET.ParseError) as exc:
    print(f"Cannot read UI hierarchy {xml_path}: {exc}", file=sys.stderr)
    raise SystemExit(1)

candidates = []
for node in root.iter("node"):
    text = " ".join(" ".join((node.attrib.get("text", ""), node.attrib.get("content-desc", ""))).split())
    if wanted not in text.casefold():
        continue
    bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not bounds:
        continue
    x1, y1, x2, y2 = map(int, bounds.groups())
    if x2 <= x1 or y2 <= y1:
        continue
    exact = text.casefold() == wanted
    clickable = node.attrib.get("clickable", "false").casefold() == "true"
    area = (x2 - x1) * (y2 - y1)
    candidates.append((exact, clickable, area, (x1 + x2) // 2, (y1 + y2) // 2))

if not candidates:
    print(f"No bounded UIAutomator node matched: {sys.argv[2]}", file=sys.stderr)
    raise SystemExit(1)

# Prefer an exact, clickable node. Area breaks ties when a label appears more than once.
candidates.sort(key=lambda candidate: (candidate[0], candidate[1], candidate[2]), reverse=True)
_, _, _, center_x, center_y = candidates[0]
print(center_x, center_y)
PY
}

if [ ! -s "$FIXTURE" ]; then fail "Deterministic video picker fixture is missing."; fi
wait_for_device || fail "ADB device did not become ready."
adb install -r app/build/outputs/apk/debug/app-debug.apk > "$RESULTS/app-install.txt" 2>&1
if [ $? -ne 0 ]; then fail "Could not install the isolated QA app."; fi
adb shell mkdir -p /sdcard/Download
adb push "$FIXTURE" /sdcard/Download/video-studio-video-qa.webm > "$RESULTS/fixture-push.txt" 2>&1
if [ $? -ne 0 ]; then fail "Could not place the video fixture in Android Downloads."; fi
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/video-studio-video-qa.webm > "$RESULTS/media-scan.txt" 2>&1 || true
adb shell wm size 720x1600 > "$RESULTS/emulator-display-size.txt" 2>&1
if [ $? -ne 0 ]; then fail "Could not set deterministic 720x1600 emulator viewport."; fi
adb shell wm density 280 > "$RESULTS/emulator-display-density.txt" 2>&1
if [ $? -ne 0 ]; then fail "Could not set deterministic 280-dpi emulator density."; fi

# Clear cached AVD logcat first: cached AVDs can contain old build diagnostics.
adb logcat -c > "$RESULTS/logcat-clear.txt" 2>&1
if [ $? -ne 0 ]; then fail "Could not clear stale Android logcat before app launch."; fi

# Stream only fresh logs from before launch, so an old page-finished event can
# never satisfy the app-load gate.
timeout --signal=TERM --kill-after=2s 150s adb logcat -v threadtime > "$RESULTS/live-logcat.txt" 2>&1 &
LOGCAT_PID=$!

adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > "$RESULTS/app-launch.txt" 2>&1
if [ $? -ne 0 ]; then fail "Launcher could not open package $PKG."; fi

app_visible=0
for attempt in $(seq 1 12); do
  adb shell dumpsys activity activities > "$RESULTS/activity-after-launch.txt" 2>&1
  if grep -Fq "$PKG/com.nexusnova.app.MainActivity" "$RESULTS/activity-after-launch.txt"; then
    app_visible=1
    break
  fi
  sleep 1
done
if [ "$app_visible" -ne 1 ]; then fail "QA MainActivity did not appear in Android activity state."; fi

# Require a fresh WebView page-finished diagnostic from this launch.
page_loaded=0
for attempt in $(seq 1 30); do
  if grep -Fq 'NexusNovaDiagnostic: runtimeBuildCommit=' "$RESULTS/live-logcat.txt"; then
    page_loaded=1
    break
  fi
  sleep 1
done
if [ "$page_loaded" -ne 1 ]; then
  fail "MainActivity did not report WebView onPageFinished within 30 seconds."
fi

# Wait for the app's bundled splash animation to finish, capture the rendered
# screen first, and keep the accessibility dump best-effort only. UiAutomator
# can return a null root on API 35 even while the WebView is running.
sleep 4
if ! capture_screenshot "$RESULTS/novacut-shell-launch.png"; then
  fail "Loaded app screenshot capture failed after three bounded ADB recovery attempts."
fi
adb shell uiautomator dump /sdcard/nova-app-window.xml > "$RESULTS/app-ui-dump.txt" 2>&1 || true
pull_remote_file /sdcard/nova-app-window.xml "$RESULTS/app-window.xml" > "$RESULTS/app-ui-pull.txt" 2>&1 || true
if [ -s "$RESULTS/app-window.xml" ]; then
  grep -Eqi 'text="NEXUSNOVA|text="nexusnovatools\.com|content-desc="Open nexusnovatools\.com in Nova Browser"' "$RESULTS/app-window.xml"
  echo "NexusNova portal text seen in UI hierarchy: $?" > "$RESULTS/app-ui-content-check.txt"
else
  echo "UIAutomator hierarchy unavailable; fresh onPageFinished diagnostic and rendered screenshot retained." > "$RESULTS/app-ui-content-check.txt"
fi

# Open Android's native document picker with the video MIME type.
adb shell am start -W -a android.intent.action.OPEN_DOCUMENT -c android.intent.category.OPENABLE -t video/* > "$RESULTS/picker-launch.txt" 2>&1
if [ $? -ne 0 ]; then fail "Android refused the native video-picker intent."; fi
sleep 2
adb shell dumpsys activity activities > "$RESULTS/activity-after-picker.txt" 2>&1
adb shell uiautomator dump /sdcard/nova-picker-window.xml > "$RESULTS/picker-ui-dump.txt" 2>&1
pull_remote_file /sdcard/nova-picker-window.xml "$RESULTS/picker-window.xml" > "$RESULTS/picker-window-pull.txt" 2>&1
if ! grep -Eqi 'com\.google\.android\.documentsui|com\.android\.documentsui|DocumentsUI' "$RESULTS/activity-after-picker.txt" "$RESULTS/picker-window.xml"; then
  fail "Native video picker UI was not identifiable after opening ACTION_OPEN_DOCUMENT."
fi

# Navigate to Downloads and verify the deterministic video is visible there.
if ! coordinates="$(find_node_center "$RESULTS/picker-window.xml" "Show roots")"; then
  fail "Could not locate the native picker's navigation menu."
fi
read -r menu_x menu_y <<< "$coordinates"
adb shell input tap "$menu_x" "$menu_y"
sleep 1
adb shell uiautomator dump /sdcard/nova-picker-roots.xml > "$RESULTS/picker-roots-dump.txt" 2>&1
pull_remote_file /sdcard/nova-picker-roots.xml "$RESULTS/picker-roots.xml" > "$RESULTS/picker-roots-pull.txt" 2>&1
if ! coordinates="$(find_node_center "$RESULTS/picker-roots.xml" "Downloads")"; then
  fail "Native picker navigation did not expose a Downloads location."
fi
read -r downloads_x downloads_y <<< "$coordinates"
adb shell input tap "$downloads_x" "$downloads_y"
sleep 2
adb shell dumpsys activity activities > "$RESULTS/activity-after-downloads.txt" 2>&1
adb shell uiautomator dump /sdcard/nova-picker-downloads.xml > "$RESULTS/picker-downloads-dump.txt" 2>&1
pull_remote_file /sdcard/nova-picker-downloads.xml "$RESULTS/picker-downloads-window.xml" > "$RESULTS/picker-downloads-pull.txt" 2>&1
if ! grep -Fq 'video-studio-video-qa.webm' "$RESULTS/picker-downloads-window.xml"; then
  fail "The native picker opened Downloads but did not show the deterministic video fixture."
fi
if ! capture_screenshot "$RESULTS/novacut-native-video-picker.png"; then
  fail "Picker screenshot capture failed after three bounded ADB recovery attempts."
fi

if ! grep -Fq 'video-studio-video-qa.webm' <(adb shell ls /sdcard/Download 2>/dev/null); then
  fail "The deterministic video fixture is not present in Downloads."
fi
stop_logcat
timeout --signal=TERM --kill-after=1s 5s adb logcat -d -v threadtime > "$RESULTS/logcat.txt" 2>&1 || true
timeout --signal=TERM --kill-after=1s 5s adb shell dumpsys activity activities > "$RESULTS/activity.txt" 2>&1 || true
echo "App shell package: $PKG" > "$RESULTS/smoke-summary.txt"
echo "Native ACTION_OPEN_DOCUMENT picker: visible" >> "$RESULTS/smoke-summary.txt"
echo "Video fixture visible in Downloads: yes" >> "$RESULTS/smoke-summary.txt"
echo "Screenshots: novacut-shell-launch.png, novacut-native-video-picker.png" >> "$RESULTS/smoke-summary.txt"
echo "ANDROID SHELL/PICKER SMOKE 1/1 PASS"
exit 0
