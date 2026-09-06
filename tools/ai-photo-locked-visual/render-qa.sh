#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=qa-artifacts/ai-photo-locked-render
PORT=4173
mkdir -p "$OUT_DIR"

CHROME="${CHROME_BIN:-}"
if [ -z "$CHROME" ]; then
  for candidate in google-chrome google-chrome-stable chromium chromium-browser chrome chrome.exe; do
    if command -v "$candidate" >/dev/null 2>&1; then
      CHROME=$(command -v "$candidate")
      break
    fi
  done
fi
if [ -z "$CHROME" ]; then
  echo '::error::Chrome/Chromium is required for rendered visual QA.' >&2
  exit 1
fi

CHROMEDRIVER="${CHROMEDRIVER_BIN:-}"
if [ -z "$CHROMEDRIVER" ]; then
  for candidate in chromedriver chromedriver.exe google-chrome-chromedriver; do
    if command -v "$candidate" >/dev/null 2>&1; then
      CHROMEDRIVER=$(command -v "$candidate")
      break
    fi
  done
fi
if [ -z "$CHROMEDRIVER" ]; then
  for candidate in /usr/local/share/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver; do
    if [ -x "$candidate" ]; then
      CHROMEDRIVER="$candidate"
      break
    fi
  done
fi
if [ -z "$CHROMEDRIVER" ]; then
  echo '::error::ChromeDriver is required for exact mobile viewport emulation.' >&2
  exit 1
fi

PYTHON=
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then PYTHON=$(command -v "$candidate"); break; fi
done
if [ -z "$PYTHON" ]; then
  echo '::error::Python is required for the local visual QA server.' >&2
  exit 1
fi

"$PYTHON" -m http.server "$PORT" --bind 127.0.0.1 --directory . >"$OUT_DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT

ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT/tools/ai-photo-locked-visual/harness.html" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo '::error::Visual QA server did not become ready.' >&2
  exit 1
fi

status=0
node tools/ai-photo-locked-visual/render-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR" || status=$?

find "$OUT_DIR" -maxdepth 1 -type f -name '*.json' -print -exec sed -n '1,30p' {} \;
if [ "$status" -ne 0 ]; then
  echo '::error::One or more actual rendered viewport checks failed.' >&2
  exit "$status"
fi
echo 'Rendered visual QA PASS — Home and Generator fit all five Android viewport contracts.'
