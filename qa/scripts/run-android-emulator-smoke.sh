#!/usr/bin/env bash
# Run as one Bash process from the Android emulator runner.
# The action's "script" input may execute each line in its own shell, so keep
# variables, PIPESTATUS, and diagnostics in this tracked script.
set +e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS="$ROOT/qa/android-emulator-results"
mkdir -p "$RESULTS"
mkdir_status=$?
if [ "$mkdir_status" -ne 0 ]; then
  echo "Could not create emulator QA results directory: $RESULTS" >&2
  exit "$mkdir_status"
fi

cd "$ROOT/NexusNovaAndroid" || exit 1

adb install -r app/build/outputs/apk/debug/app-debug.apk
app_install_status=$?
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
test_install_status=$?

if [ "$app_install_status" -ne 0 ] || [ "$test_install_status" -ne 0 ]; then
  echo "Instrumentation setup failed: app=$app_install_status test=$test_install_status" | tee "$RESULTS/setup-status.txt"
  adb logcat -d -v threadtime > "$RESULTS/logcat.txt" 2>&1 || true
  exit 1
fi

if [ ! -s "$ROOT/qa/fixtures/video-studio-video-qa.webm" ]; then
  echo "Deterministic Android video fixture is missing." | tee "$RESULTS/setup-status.txt"
  exit 1
fi

timeout --signal=TERM --kill-after=10s 150s adb shell am instrument -w -r \
  -e class com.nexusnova.app.NovaCutAndroidShellSmokeTest#androidShellLaunchesAndNativeVideoPickerOpens \
  com.nexusnova.app.test/androidx.test.runner.AndroidJUnitRunner 2>&1 | tee "$RESULTS/instrumentation.txt"
instrumentation_status=${PIPESTATUS[0]}

if grep -Eq 'FAILURES!!!|INSTRUMENTATION_STATUS_CODE: -2|Tests run: [0-9]+, Failures: [1-9]' "$RESULTS/instrumentation.txt"; then
  instrumentation_status=1
fi
if ! grep -Eq 'OK \(1 test\)|OK \(1 tests\)' "$RESULTS/instrumentation.txt"; then
  instrumentation_status=1
fi
echo "$instrumentation_status" > "$RESULTS/instrumentation-exit-code.txt"

adb logcat -d -v threadtime > "$RESULTS/logcat.txt" 2>&1 || true
adb shell dumpsys activity activities > "$RESULTS/activity.txt" 2>&1 || true
adb shell dumpsys window > "$RESULTS/window.txt" 2>&1 || true
adb shell getprop > "$RESULTS/device-properties.txt" 2>&1 || true
adb shell ls -la /sdcard/Android/data/com.nexusnova.app.novacutqa/files/Pictures/ > "$RESULTS/pictures-directory.txt" 2>&1 || true
adb pull /sdcard/Android/data/com.nexusnova.app.novacutqa/files/Pictures "$RESULTS/" > "$RESULTS/pictures-pull.txt" 2>&1 || true

if [ "$instrumentation_status" -ne 0 ]; then
  echo "Android instrumentation failed (exit $instrumentation_status). Logs/evidence: $RESULTS" >&2
else
  echo "ANDROID SHELL/PICKER SMOKE 1/1 PASS"
fi
exit "$instrumentation_status"
