#!/usr/bin/env bash
set -u

RESULTS_DIR="$GITHUB_WORKSPACE/qa/android-emulator-results"
RUNNER_OUTPUT="$RESULTS_DIR/connected-test.txt"

ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"

adb start-server >/dev/null 2>&1 || true
adb wait-for-device

boot=""
for attempt in $(seq 1 40); do
  boot="$(adb -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | tail -n 1 || true)"
  if [ "$boot" = "1" ]; then break; fi
  sleep 2
done

if [ "$boot" != "1" ]; then
  echo "Android emulator did not reach sys.boot_completed=1."
  adb -s "$ANDROID_SERIAL" get-state || true
  exit 1
fi

# Reset package data deterministically. Cached AVD state can survive while an
# uninstall fails with Android Package Manager internals.
adb -s "$ANDROID_SERIAL" shell am force-stop com.nexusnova.app || true
adb -s "$ANDROID_SERIAL" shell pm clear com.nexusnova.app || true
adb -s "$ANDROID_SERIAL" shell am force-stop com.nexusnova.app.test || true
adb -s "$ANDROID_SERIAL" shell pm clear com.nexusnova.app.test || true
adb -s "$ANDROID_SERIAL" uninstall com.nexusnova.app || true
adb -s "$ANDROID_SERIAL" uninstall com.nexusnova.app.test || true

mkdir -p "$RESULTS_DIR"
rm -f "$RUNNER_OUTPUT"

set +e
timeout --signal=TERM --kill-after=30s 12m \
  gradle --no-daemon :app:connectedDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.class=com.nexusnova.app.VideoStudioEmulatorQaTest \
    --stacktrace > "$RUNNER_OUTPUT" 2>&1
status=$?
set -e

if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
  echo "Android instrumentation exceeded the 12-minute hard runtime limit."
  echo "Dumping focused device state and recent logcat before failing."
  adb shell dumpsys activity activities | tail -n 160 || true
  adb shell dumpsys window windows | tail -n 160 || true
  adb logcat -d -v threadtime -t 4000 > "$RESULTS_DIR/logcat-timeout.txt" || true
fi

cat "$RUNNER_OUTPUT"
cp -R app/build/outputs/androidTest-results "$RESULTS_DIR/" || true
cp -R app/build/outputs/logs "$RESULTS_DIR/" || true
adb logcat -d -v threadtime > "$RESULTS_DIR/logcat.txt" || true

if [ "$status" -ne 0 ]; then
  echo "Connected Android test task failed with exit code $status"
  exit "$status"
fi

result_xml_count=$(find app/build/outputs/androidTest-results -type f -name '*.xml' 2>/dev/null | wc -l | tr -d ' ')
if [ "$result_xml_count" -lt 1 ]; then
  echo "No Android instrumentation result XML was produced."
  exit 1
fi

completed_tests=$(grep -Roh 'tests="[0-9]*"' app/build/outputs/androidTest-results 2>/dev/null | sed 's/[^0-9]//g' | awk '{s+=$1} END{print s+0}')
failures=$(grep -Roh 'failures="[0-9]*"' app/build/outputs/androidTest-results 2>/dev/null | sed 's/[^0-9]//g' | awk '{s+=$1} END{print s+0}')
errors=$(grep -Roh 'errors="[0-9]*"' app/build/outputs/androidTest-results 2>/dev/null | sed 's/[^0-9]//g' | awk '{s+=$1} END{print s+0}')

echo "RESULTS: tests=$completed_tests failures=$failures errors=$errors"

if [ "$completed_tests" -ne 1 ] || [ "$failures" -ne 0 ] || [ "$errors" -ne 0 ]; then
  echo "Expected exactly 1 passing Video Studio Hard QA test with 15 gates."
  exit 1
fi

echo "1/1 Video Studio Hard QA PASS — 15 runtime gates."
