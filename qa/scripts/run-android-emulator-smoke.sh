#!/usr/bin/env bash
# Deterministic Android shell and native video-picker smoke test.
# Run through android-emulator-runner from NexusNovaAndroid.
set +e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS="$ROOT/qa/android-emulator-results"
mkdir -p "$RESULTS"
if [ $? -ne 0 ]; then
  echo "Could not create emulator QA results directory: $RESULTS" >&2
  exit 1
fi

cd "$ROOT/NexusNovaAndroid" || exit 1
PKG="com.nexusnova.app.novacutqa"
FIXTURE="$ROOT/qa/fixtures/video-studio-video-qa.webm"

fail() {
  echo "ANDROID SHELL/PICKER SMOKE FAIL: $*" | tee "$RESULTS/failure.txt" >&2
  adb logcat -d -v threadtime > "$RESULTS/logcat.txt" 2>&1 || true
  adb shell dumpsys activity activities > "$RESULTS/activity.txt" 2>&1 || true
  adb shell dumpsys window > "$RESULTS/window.txt" 2>&1 || true
  adb shell uiautomator dump /sdcard/nova-window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/nova-window.xml "$RESULTS/window-hierarchy.xml" >/dev/null 2>&1 || true
  exit 1
}

adb wait-for-device
if [ $? -ne 0 ]; then fail "ADB device did not become ready."; fi

adb install -r app/build/outputs/apk/debug/app-debug.apk
if [ $? -ne 0 ]; then fail "Could not install the isolated QA app."; fi

if [ ! -s "$FIXTURE" ]; then fail "Deterministic video picker fixture is missing."; fi
adb shell mkdir -p /sdcard/Download
adb push "$FIXTURE" /sdcard/Download/video-studio-video-qa.webm > "$RESULTS/fixture-push.txt" 2>&1
if [ $? -ne 0 ]; then fail "Could not place the video fixture in Android Downloads."; fi
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/video-studio-video-qa.webm > "$RESULTS/media-scan.txt" 2>&1 || true

# Launch the actual app shell, wait for the package activity, and retain a screenshot.
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > "$RESULTS/app-launch.txt" 2>&1
if [ $? -ne 0 ]; then fail "Launcher could not open package $PKG."; fi

app_visible=0
for attempt in $(seq 1 15); do
  adb shell dumpsys activity activities > "$RESULTS/activity-after-launch.txt" 2>&1
  if grep -Fq "$PKG" "$RESULTS/activity-after-launch.txt"; then
    app_visible=1
    break
  fi
  sleep 2
done
if [ "$app_visible" -ne 1 ]; then fail "QA app activity did not appear in Android activity state."; fi
# Give the native shell/WebView a moment to leave its first-frame splash before capturing evidence.
sleep 6
adb shell screencap -p /sdcard/novacut-shell-launch.png
adb pull /sdcard/novacut-shell-launch.png "$RESULTS/novacut-shell-launch.png" > "$RESULTS/app-screenshot-pull.txt" 2>&1
if [ $? -ne 0 ] || [ ! -s "$RESULTS/novacut-shell-launch.png" ]; then fail "Could not capture the launched app screenshot."; fi

find_node_center() {
  python3 - "$1" "$2" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

xml_path, target = sys.argv[1], sys.argv[2].strip().lower()
root = ET.parse(xml_path).getroot()
for node in root.iter("node"):
    labels = (node.attrib.get("text", ""), node.attrib.get("content-desc", ""))
    if not any(label.strip().lower() == target for label in labels):
        continue
    bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if bounds:
        x1, y1, x2, y2 = map(int, bounds.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        raise SystemExit(0)
raise SystemExit(2)
PY
}

# Exercise Android's real document picker with video MIME type.
adb shell am start -W -a android.intent.action.OPEN_DOCUMENT \
  -c android.intent.category.OPENABLE -t video/* > "$RESULTS/picker-launch.txt" 2>&1
if [ $? -ne 0 ]; then fail "Android refused the native video-picker intent."; fi
sleep 2
adb shell dumpsys activity activities > "$RESULTS/activity-after-picker.txt" 2>&1
adb shell uiautomator dump /sdcard/nova-picker-window.xml > "$RESULTS/picker-ui-dump.txt" 2>&1
adb pull /sdcard/nova-picker-window.xml "$RESULTS/picker-window.xml" > "$RESULTS/picker-window-pull.txt" 2>&1
if ! grep -Eqi 'com\.google\.android\.documentsui|com\.android\.documentsui|DocumentsUI' \
  "$RESULTS/activity-after-picker.txt" "$RESULTS/picker-window.xml"; then
  fail "Native video picker UI was not identifiable after opening ACTION_OPEN_DOCUMENT."
fi

# Open the picker's navigation drawer, enter Downloads, and verify the fixture is actually visible.
if ! coordinates="$(find_node_center "$RESULTS/picker-window.xml" "Show roots")"; then
  fail "Could not locate the native picker's navigation menu."
fi
read -r menu_x menu_y <<< "$coordinates"
adb shell input tap "$menu_x" "$menu_y"
sleep 1
adb shell uiautomator dump /sdcard/nova-picker-roots.xml > "$RESULTS/picker-roots-dump.txt" 2>&1
adb pull /sdcard/nova-picker-roots.xml "$RESULTS/picker-roots.xml" > "$RESULTS/picker-roots-pull.txt" 2>&1
if ! coordinates="$(find_node_center "$RESULTS/picker-roots.xml" "Downloads")"; then
  fail "Native picker navigation did not expose a Downloads location."
fi
read -r downloads_x downloads_y <<< "$coordinates"
adb shell input tap "$downloads_x" "$downloads_y"
sleep 2
adb shell dumpsys activity activities > "$RESULTS/activity-after-downloads.txt" 2>&1
adb shell uiautomator dump /sdcard/nova-picker-downloads.xml > "$RESULTS/picker-downloads-dump.txt" 2>&1
adb pull /sdcard/nova-picker-downloads.xml "$RESULTS/picker-downloads-window.xml" > "$RESULTS/picker-downloads-pull.txt" 2>&1
if ! grep -Fq 'video-studio-video-qa.webm' "$RESULTS/picker-downloads-window.xml"; then
  fail "The native picker opened Downloads but did not show the deterministic video fixture."
fi

adb shell screencap -p /sdcard/novacut-native-video-picker.png
adb pull /sdcard/novacut-native-video-picker.png "$RESULTS/novacut-native-video-picker.png" > "$RESULTS/picker-screenshot-pull.txt" 2>&1
if [ $? -ne 0 ] || [ ! -s "$RESULTS/novacut-native-video-picker.png" ]; then
  fail "Could not capture the native video-picker screenshot."
fi
if ! grep -Fq 'video-studio-video-qa.webm' <(adb shell ls /sdcard/Download 2>/dev/null); then
  fail "The deterministic video fixture is not present in Downloads."
fi

adb logcat -d -v threadtime > "$RESULTS/logcat.txt" 2>&1 || true
adb shell dumpsys activity activities > "$RESULTS/activity.txt" 2>&1 || true
echo "App shell package: $PKG" > "$RESULTS/smoke-summary.txt"
echo "Native ACTION_OPEN_DOCUMENT picker: visible" >> "$RESULTS/smoke-summary.txt"
echo "Video fixture: /sdcard/Download/video-studio-video-qa.webm" >> "$RESULTS/smoke-summary.txt"
echo "Screenshots: novacut-shell-launch.png, novacut-native-video-picker.png" >> "$RESULTS/smoke-summary.txt"
echo "ANDROID SHELL/PICKER SMOKE 1/1 PASS"
exit 0
