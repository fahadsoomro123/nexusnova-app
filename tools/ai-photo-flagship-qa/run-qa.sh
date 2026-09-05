#!/usr/bin/env bash
set -uo pipefail

OUT_DIR=qa-artifacts/ai-photo-flagship
PORT=4174
mkdir -p "$OUT_DIR"

CHROME=
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROME=$(command -v "$candidate"); break; fi
done
test -n "$CHROME" || { echo '::error::Chrome/Chromium is required.' >&2; exit 1; }

CHROMEDRIVER=
for candidate in chromedriver google-chrome-chromedriver; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROMEDRIVER=$(command -v "$candidate"); break; fi
done
if [ -z "$CHROMEDRIVER" ]; then
  for candidate in /usr/local/share/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver; do
    if [ -x "$candidate" ]; then CHROMEDRIVER="$candidate"; break; fi
  done
fi
test -n "$CHROMEDRIVER" || { echo '::error::ChromeDriver is required.' >&2; exit 1; }

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory . >"$OUT_DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT/tools/ai-photo-flagship-qa/harness.html" >/dev/null; then break; fi
  sleep 1
done

STATUS=0
run_suite(){
  local label="$1"; shift
  echo "::group::$label"
  if "$@"; then
    echo "$label: PASS"
  else
    echo "::error::$label failed"
    STATUS=1
  fi
  echo "::endgroup::"
}

run_suite "Flagship behavior QA" node tools/ai-photo-flagship-qa/behavior-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Flagship tool upgrades v11 QA" node tools/ai-photo-flagship-qa/flagship-tools-v11-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Enhance v12 large-photo responsiveness QA" node tools/ai-photo-flagship-qa/enhance-v12-performance-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Design Editor execution QA" node tools/ai-photo-flagship-qa/design-editor-qa-v2.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Design Studio delight v13 QA" node tools/ai-photo-flagship-qa/design-delight-v13-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Flagship shell v14 phone visibility and smoothness QA" node tools/ai-photo-flagship-qa/flagship-shell-v14-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Photo Editor execution QA" node tools/ai-photo-flagship-qa/photo-editor-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Photo Editor strict pixel QA" node tools/ai-photo-flagship-qa/photo-editor-strict-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Photo AI zero-cost execution QA" node tools/ai-photo-flagship-qa/photo-ai-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Photo Editor diagnostics" node tools/ai-photo-flagship-qa/photo-editor-diagnostics.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"

exit "$STATUS"
