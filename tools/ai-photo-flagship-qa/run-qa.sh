#!/usr/bin/env bash
set -uo pipefail

OUT_DIR=qa-artifacts/ai-photo-flagship
PORT=4174
mkdir -p "$OUT_DIR"

CHROME="${CHROME_BIN:-}"
if [ -z "$CHROME" ]; then
  for candidate in google-chrome google-chrome-stable chromium chromium-browser chrome chrome.exe; do
    if command -v "$candidate" >/dev/null 2>&1; then CHROME=$(command -v "$candidate"); break; fi
  done
fi
test -n "$CHROME" || { echo '::error::Chrome/Chromium is required.' >&2; exit 1; }

CHROMEDRIVER="${CHROMEDRIVER_BIN:-}"
if [ -z "$CHROMEDRIVER" ]; then
  for candidate in chromedriver chromedriver.exe google-chrome-chromedriver; do
    if command -v "$candidate" >/dev/null 2>&1; then CHROMEDRIVER=$(command -v "$candidate"); break; fi
  done
fi
if [ -z "$CHROMEDRIVER" ]; then
  for candidate in /usr/local/share/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver; do
    if [ -x "$candidate" ]; then CHROMEDRIVER="$candidate"; break; fi
  done
fi
test -n "$CHROMEDRIVER" || { echo '::error::ChromeDriver is required.' >&2; exit 1; }

node tools/ai-photo-flagship-qa/static-server.mjs "$PORT" >"$OUT_DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT/tools/ai-photo-flagship-qa/harness.html" >/dev/null; then ready=1; break; fi
  sleep 1
done
test "$ready" -eq 1 || { echo '::error::QA server did not become ready.' >&2; exit 1; }

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

run_suite "Photo Adjust v18 executable pixel, workflow and viewport QA" node tools/ai-photo-flagship-qa/adjust-v18-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Global slider focus touch, keyboard and dynamic-control QA" node tools/ai-photo-flagship-qa/slider-focus-global-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Core navigation v17 regression QA" node tools/ai-photo-flagship-qa/core-architecture-v17-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Generative Edit v19 source-image, mask guidance and candidate QA" node tools/ai-photo-flagship-qa/generative-edit-v19-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Flagship behavior v16 QA" node tools/ai-photo-flagship-qa/behavior-v16-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Flagship tool upgrades v16 QA" node tools/ai-photo-flagship-qa/flagship-tools-v16-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Enhance v12 large-photo responsiveness QA" node tools/ai-photo-flagship-qa/enhance-v12-performance-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Retouch Repair v20 executable pixel and history QA" node tools/ai-photo-flagship-qa/retouch-repair-v20-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Product Studio v21 executable composition and phone QA" node tools/ai-photo-flagship-qa/product-studio-v21-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Design flagship v22 structured font crop and phone QA" node tools/ai-photo-flagship-qa/design-flagship-v22-live-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Batch v23 multi-file transform failure isolation and phone QA" node tools/ai-photo-flagship-qa/batch-v23-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Projects persistence and PNG JPEG export v24 QA" node tools/ai-photo-flagship-qa/projects-export-v24-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Design Editor execution QA" node tools/ai-photo-flagship-qa/design-editor-qa-v2.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Design Studio delight v13 QA" node tools/ai-photo-flagship-qa/design-delight-v13-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Flagship shell v16 phone visibility and smoothness QA" node tools/ai-photo-flagship-qa/flagship-shell-v16-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Remove BG ML v16 deterministic matte QA" node tools/ai-photo-flagship-qa/remove-bg-ml-v16-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Photo Editor execution QA" node tools/ai-photo-flagship-qa/photo-editor-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Photo Editor strict pixel QA" node tools/ai-photo-flagship-qa/photo-editor-strict-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Photo AI zero-cost execution QA" node tools/ai-photo-flagship-qa/photo-ai-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
run_suite "Photo Editor diagnostics" node tools/ai-photo-flagship-qa/photo-editor-diagnostics.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"

exit "$STATUS"
